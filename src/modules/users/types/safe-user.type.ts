import { User } from "../entities/user.entity";

type WithoutPassword = 'password';

export type SafeUser = Omit<User, WithoutPassword>;