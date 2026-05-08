import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, desc, and, sql } from 'drizzle-orm';
import {
  DRIZZLE_DATABASE,
  type PostgresJsDatabase,
} from '@lark-apaas/fullstack-nestjs-core';
import { CapabilityService } from '@lark-apaas/fullstack-nestjs-core';
import { dataSource, syncedData } from '../../database/schema';

export interface CreateDataSourceDto {
  name: string;
  baseToken: string;
  tableId: string;
  viewId?: string;
  description?: string;
}

export interface UpdateDataSourceDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface DataSourceRecord {
  id: string;
  record: Record<string, any>;
}

@Injectable()
export class DataSourceService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly capabilityService: CapabilityService,
  ) {}

  async findAll() {
    return this.db
      .select()
      .from(dataSource)
      .orderBy(desc(dataSource.createdAt));
  }

  async findById(id: string) {
    const [source] = await this.db
      .select()
      .from(dataSource)
      .where(eq(dataSource.id, id));
    return source;
  }

  async create(dto: CreateDataSourceDto, userId: string) {
    const [source] = await this.db
      .insert(dataSource)
      .values({
        name: dto.name,
        baseToken: dto.baseToken,
        tableId: dto.tableId,
        viewId: dto.viewId,
        description: dto.description,
        syncStatus: 'pending',
      })
      .returning();
    return source;
  }

  async update(id: string, dto: UpdateDataSourceDto) {
    const [source] = await this.db
      .update(dataSource)
      .set({
        ...dto,
        updatedAt: new Date(),
      })
      .where(eq(dataSource.id, id))
      .returning();
    return source;
  }

  async delete(id: string) {
    await this.db.delete(dataSource).where(eq(dataSource.id, id));
  }

  async syncData(id: string) {
    const source = await this.findById(id);
    if (!source) {
      throw new NotFoundException('Data source not found');
    }

    // Update status to syncing
    await this.db
      .update(dataSource)
      .set({ syncStatus: 'syncing' })
      .where(eq(dataSource.id, id));

    try {
      // Fetch all records from Feishu Bitable
      const allRecords: DataSourceRecord[] = [];
      let pageToken: string | undefined;
      let hasMore = true;

      while (hasMore) {
        const response = (await this.capabilityService
          .load('feishu_multi_table_manage_crud_agg_1')
          .call('searchRecords', {
            baseToken: source.baseToken,
            tableId: source.tableId,
            pageSize: 500,
            pageToken,
          })) as {
            records: DataSourceRecord[];
            hasMore: boolean;
            pageToken?: string;
          };

        allRecords.push(...(response.records || []));
        hasMore = response.hasMore || false;
        pageToken = response.pageToken;
      }

      // Clear existing synced data
      await this.db.delete(syncedData).where(eq(syncedData.dataSourceId, id));

      // Insert new synced data
      if (allRecords.length > 0) {
        await this.db.insert(syncedData).values(
          allRecords.map((record) => ({
            dataSourceId: id,
            recordId: record.id,
            data: record.record,
          })),
        );
      }

      // Update source status
      const [updated] = await this.db
        .update(dataSource)
        .set({
          syncStatus: 'success',
          lastSyncAt: new Date(),
          recordCount: allRecords.length,
        })
        .where(eq(dataSource.id, id))
        .returning();

      return {
        success: true,
        recordCount: allRecords.length,
        dataSource: updated,
      };
    } catch (error) {
      // Update status to failed
      await this.db
        .update(dataSource)
        .set({
          syncStatus: 'failed',
        })
        .where(eq(dataSource.id, id));

      throw error;
    }
  }

  async getSyncedData(dataSourceId: string, search?: string) {
    const conditions = [eq(syncedData.dataSourceId, dataSourceId)];

    if (search) {
      // Search in JSON data
      conditions.push(
        sql`data::text ILIKE ${`%${search}%`}`,
      );
    }

    return this.db
      .select()
      .from(syncedData)
      .where(and(...conditions))
      .orderBy(desc(syncedData.createdAt));
  }

  async getSyncedDataById(dataSourceId: string, recordId: string) {
    const [record] = await this.db
      .select()
      .from(syncedData)
      .where(
        and(
          eq(syncedData.dataSourceId, dataSourceId),
          eq(syncedData.recordId, recordId),
        ),
      );
    return record;
  }

  async getAllActiveDataSources() {
    return this.db
      .select()
      .from(dataSource)
      .where(eq(dataSource.isActive, true))
      .orderBy(desc(dataSource.createdAt));
  }
}
