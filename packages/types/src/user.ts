import type { BasicUserInfo } from '@vben-core/typings';

/** 用户信息 */
interface UserInfo extends BasicUserInfo {
  /**
   * 登录方式
   */
  authProvider?: string;
  /**
   * 部门
   */
  department?: string;
  /**
   * 直属上级姓名
   */
  directLeaderName?: string;
  /**
   * 直属上级飞书 user_id
   */
  directLeaderUserId?: string;
  /**
   * 邮箱
   */
  email?: string;
  /**
   * 用户描述
   */
  desc: string;
  /**
   * 首页地址
   */
  homePath: string;

  /**
   * accessToken
   */
  token: string;
}

export type { UserInfo };
