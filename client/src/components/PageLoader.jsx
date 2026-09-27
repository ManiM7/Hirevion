import Spinner from './Spinner';

export default function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
      <Spinner dark size={28} />
    </div>
  );
}
