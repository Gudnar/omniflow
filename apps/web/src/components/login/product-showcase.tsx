'use client';

import Image from 'next/image';

export function ProductShowcase() {
  return (
    <div className="relative w-full max-w-sm mx-auto">
      <div className="relative w-full rounded-xl shadow-2xl overflow-hidden" style={{ aspectRatio: '1448 / 1086' }}>
        <Image
          src="/images/3.png"
          alt="Dashboard de OmniFlow"
          fill
          className="object-cover object-top"
          priority
        />
      </div>

      <div
        className="absolute -bottom-10 -right-10 w-[38%] drop-shadow-2xl"
        style={{ aspectRatio: '853 / 1844' }}
      >
        <Image
          src="/images/4.png"
          alt="Chat de OmniFlow IA en el celular"
          fill
          className="object-contain"
        />
      </div>
    </div>
  );
}
