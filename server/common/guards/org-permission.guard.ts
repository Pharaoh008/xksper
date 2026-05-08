import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationService } from '../../modules/organization/organization.service';
import {
  ORG_PERMISSION_KEY,
  type OrgPermissionOptions,
} from '../decorators/org-permission.decorator';

interface UserContext {
  userId: string;
  tenantId: string;
  appId: string;
  env: 'preview' | 'runtime';
  userName: string;
  userNameEn: string;
  userNameI18n: string;
}

interface RequestWithUser {
  userContext: UserContext;
  params: Record<string, string>;
  body: Record<string, unknown>;
  method: string;
}

@Injectable()
export class OrgPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly organizationService: OrganizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<OrgPermissionOptions>(
      ORG_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 如果没有配置权限检查，则放行
    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userContext = request.userContext;

    if (!userContext) {
      throw new ForbiddenException('未获取到用户信息');
    }

    // 从请求参数中获取资源ID
    const resourceId =
      request.params[options.resourceIdParam || 'id'] || request.body.id;

    if (!resourceId) {
      // 如果是列表查询，不检查具体资源权限
      if (request.method === 'GET' && !request.params.id) {
        return true;
      }
      throw new ForbiddenException('未指定资源ID');
    }

    // 获取用户的角色信息
    // 这里假设用户角色信息存储在某个服务中，或者通过其他方式获取
    // 简化实现：所有用户都可以访问，实际使用时需要根据角色进行检查
    return true;
  }
}
