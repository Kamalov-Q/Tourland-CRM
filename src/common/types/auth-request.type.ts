import { Request } from "express";
import { UserRole } from "src/modules/users/entities/user.entity";

export interface JwtPayload {
    sub: string;
    phoneNumber: string;
    role: UserRole;
    canAccessDepartments?: boolean;
    canAccessForms?: boolean;
}

export interface AuthenticatedUser {
    id: string;
    phoneNumber: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    isActive: boolean;
    canAccessDepartments: boolean;
    canAccessForms: boolean;
}

export interface AuthenticatedRequest extends Request {
    user: AuthenticatedUser;
}