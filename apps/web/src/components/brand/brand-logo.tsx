import Image from 'next/image';

type BrandLogoProps = {
  variant?: 'default' | 'light';
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
};

const SIZES = {
  sm: { width: 120, height: 28 },
  md: { width: 160, height: 36 },
  lg: { width: 200, height: 48 },
};

export function BrandLogo({ variant = 'default', showText = true, size = 'md' }: BrandLogoProps) {
  const dimensions = SIZES[size];

  if (!showText) {
    return (
      <Image
        src="/favicon.svg"
        alt="Transit Logistic"
        width={32}
        height={32}
        priority
        className={variant === 'light' ? 'brand-logo--light' : undefined}
      />
    );
  }

  return (
    <Image
      src="/logo.svg"
      alt="Transit Logistic"
      width={dimensions.width}
      height={dimensions.height}
      priority
      className={variant === 'light' ? 'brand-logo--light' : undefined}
    />
  );
}
