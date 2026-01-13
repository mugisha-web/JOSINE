
export enum UserRole {
  ADMIN = 'ADMIN',
  SELLER = 'SELLER'
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  photoURL?: string;
  createdAt: any;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  createdAt: any;
  updatedAt?: any;
}

export enum PaymentMethod {
  CASH = 'CASH',
  MOMO = 'MOMO'
}

export interface Sale {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  paymentMethod: PaymentMethod;
  sellerId: string;
  sellerName: string;
  createdAt: any;
}

export interface ReportArchive {
  id: string;
  title: string;
  period: string;
  totalSales: number;
  transactionCount: number;
  generatedBy: string;
  generatedById: string;
  createdAt: any;
}

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  recipientId?: string; // If null, it's a group message
  createdAt: any;
  isAi?: boolean;
}
