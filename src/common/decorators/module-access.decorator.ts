import { SetMetadata } from '@nestjs/common';

export type AppModule = 'departments' | 'forms';
export const MODULE_ACCESS_KEY = 'module_access';

export const CheckModuleAccess = (module: AppModule) => SetMetadata(MODULE_ACCESS_KEY, module);
