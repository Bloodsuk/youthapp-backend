export interface IMessage {
    id: number;
    practitioner_id: number;
    practitioner_name: string;
    customer_id: number;
    customer_name: string;
    message: string;
    is_deleted: boolean;
    is_read: boolean;
    created_at: string;
    updated_at: string;
}