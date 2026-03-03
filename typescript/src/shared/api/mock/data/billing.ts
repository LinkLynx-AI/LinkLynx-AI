export type PaymentMethod = {
  id: string;
  type: "visa" | "mastercard" | "paypal";
  last4: string;
  expiresMonth: number;
  expiresYear: number;
  isDefault: boolean;
};

export type BillingHistoryEntry = {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: "paid" | "pending" | "failed";
};

export const mockPaymentMethods: PaymentMethod[] = [];

export const mockBillingHistory: BillingHistoryEntry[] = [];
