import { useApp } from '../services/AppContext';
import { useNavigate } from 'react-router-dom';

export function Toast() {
  const { toast } = useApp();
  return <div className={`toast${toast.show ? ' show' : ''}`}>{toast.msg}</div>;
}

export function AlertBanner() {
  const { alert, hideAlert } = useApp();
  const navigate = useNavigate();

  function handleClick() {
    hideAlert();
    navigate('/queue');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <button
      type="button"
      className={`alert-banner${alert.show ? ' show' : ''}`}
      onClick={handleClick}
    >
      <div className="alert-dot" />
      <span>{alert.msg}</span>
    </button>
  );
}
