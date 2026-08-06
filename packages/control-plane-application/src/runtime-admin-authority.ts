export {
  assumeAdminRole,
  handoffAdminRole,
  releaseAdminRole,
  type ActiveAdminRoleSession,
  type AdminRoleAuthorityDependencies,
} from './use-cases/assume-admin-role.ts';
export {
  executeAdminCommand,
  type AdminCommandDependencies,
} from './use-cases/execute-admin-command.ts';
