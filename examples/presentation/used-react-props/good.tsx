// src/presentation/order-card.tsx
type OrderCardProps = {
  title: string;
  isOpen: boolean;
};

export const OrderCard = ({ title, isOpen }: OrderCardProps): JSX.Element => (
  <div>{isOpen ? title : "Closed"}</div>
);
