// src/presentation/order-card.tsx
type OrderCardProps = {
  title: string;
  isOpen: boolean;
};

export const OrderCard = ({ title }: OrderCardProps): JSX.Element => <div>{title}</div>;
