
import { useNavigate } from 'react-router-dom';

const OrderButton = ({ className = '' }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/pedidos');
  };

  return (
    <button
      onClick={handleClick}
      className={`bg-primary text-white px-6 py-2 rounded-lg font-bold hover:bg-pink-600 transition-colors ${className}`}
    >
      FAÇA SEU PEDIDO
    </button>
  );
};

export default OrderButton; 