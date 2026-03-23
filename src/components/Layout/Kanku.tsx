interface KankuProps {
  size?: number;
  className?: string;
}

export default function Kanku({ size = 40, className = '' }: KankuProps) {
  return (
    <img
      src="/Kanku_Kyokushin.svg.png"
      alt="Kyokushin Kanku"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}
