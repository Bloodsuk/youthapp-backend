export interface IRolePermission {
    id: number;
    permission_name: string;
    is_active: number;
    is_assigned: number;
    role_id: number;
    created_at: string;
}
