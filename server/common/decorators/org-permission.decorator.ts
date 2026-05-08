import { SetMetadata } from '@nestjs/common';
import type { PermissionType } from '@shared/api.interface';

export const ORG_PERMISSION_KEY = 'orgPermission';

export interface OrgPermissionOptions {
  resourceType: PermissionType;
  resourceIdParam?: string;
}

export const OrgPermission = (options: OrgPermissionOptions) =>
  SetMetadata(ORG_PERMISSION_KEY, options);
