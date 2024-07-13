export interface IMessage {
    id: number;
    sent_from: number;
    sent_from_role: string;
    sent_to: number;
    sent_to_role: string;
    message: string;
    is_read: boolean;
    created_at: string;
    display_name: string;
}

export interface IUnreadMessageCount {
    unread_count: number;
}

export interface ICustomerPracMessage {
    sent_by_customer_id: number;
    message_type: string;
}