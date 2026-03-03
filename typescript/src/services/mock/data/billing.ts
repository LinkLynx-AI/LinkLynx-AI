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
  amount: number; // in yen
  status: "paid" | "pending" | "failed";
};

export const mockPaymentMethods: PaymentMethod[] = [
  {
    id: "pm-1",
    type: "visa",
    last4: "4242",
    expiresMonth: 8,
    expiresYear: 2027,
    isDefault: true,
  },
  {
    id: "pm-2",
    type: "mastercard",
    last4: "5555",
    expiresMonth: 3,
    expiresYear: 2028,
    isDefault: false,
  },
];

export const mockBillingHistory: BillingHistoryEntry[] = [
  {
    id: "bh-1",
    date: "2026-02-01",
    description: "Nitro (月額)",
    amount: 1050,
    status: "paid",
  },
  {
    id: "bh-2",
    date: "2026-01-01",
    description: "Nitro (月額)",
    amount: 1050,
    status: "paid",
  },
  {
    id: "bh-3",
    date: "2025-12-01",
    description: "Nitro (月額)",
    amount: 1050,
    status: "paid",
  },
  {
    id: "bh-4",
    date: "2025-11-01",
    description: "サーバーブースト",
    amount: 980,
    status: "paid",
  },
  {
    id: "bh-5",
    date: "2025-10-15",
    description: "Nitro ギフト",
    amount: 1050,
    status: "pending",
  },
  {
    id: "bh-6",
    date: "2025-10-01",
    description: "Nitro (月額)",
    amount: 1050,
    status: "failed",
  },
];
