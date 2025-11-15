import hdLogo from '../assets/1ccfd6d57f7ce66b9991f55ed3e9ec600aadd57a.png';

export function MobileWatermark() {
  return (
    <div 
      className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center"
      style={{ 
        top: '50%', 
        transform: 'translateY(-50%)'
      }}
    >
      <img 
        src={hdLogo || "/placeholder.svg"}
        alt=""
        className="w-[400px] h-[400px] lg:w-[600px] lg:h-[600px] object-contain"
        style={{ opacity: 0.10 }}
      />
    </div>
  );
}
