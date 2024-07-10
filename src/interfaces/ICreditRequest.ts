export interface ICreditRequest {
    id: number ;
    user_id: number ;
    status: string;
    credit_amount: number ;
    remarks: string;
    is_order: number;
    created_at: string;
}