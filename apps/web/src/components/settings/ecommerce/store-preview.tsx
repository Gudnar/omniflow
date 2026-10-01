'use client';

import type { EcommerceSection, EcommerceStoreSettings } from '@/lib/types';

export function StorePreview({
  storeName,
  settings,
  sections,
}: {
  storeName: string;
  settings: EcommerceStoreSettings;
  sections: EcommerceSection[];
}) {
  const enabledSections = sections.filter((s) => s.enabled).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="sticky top-6">
      <p className="text-xs font-semibold text-gray-500 mb-2 text-center">Vista previa</p>
      <div className="mx-auto w-[260px] h-[540px] rounded-[2rem] border-[8px] border-gray-900 bg-gray-900 shadow-xl overflow-hidden">
        <div
          className="w-full h-full overflow-y-auto"
          style={{ backgroundColor: settings.backgroundColor, fontFamily: settings.fontFamily }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2 px-3 py-3"
            style={{ backgroundColor: settings.primaryColor }}
          >
            {settings.mobileLogo || settings.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.mobileLogo || settings.logo || ''} alt="Logo" className="w-6 h-6 rounded object-cover" />
            ) : (
              <div className="w-6 h-6 rounded bg-white/30" />
            )}
            <p className="text-xs font-bold text-white truncate">{storeName || 'Mi tienda'}</p>
          </div>

          {/* Hero — prefers the mobile-specific image, falls back to the
              desktop one so setting only "Imagen de portada" still shows here.
              Natural height (no object-cover): merchants often upload a
              ready-made banner graphic with its own text/logo, which a
              fixed-height crop would slice off. */}
          {settings.mobileHeroImage || settings.heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.mobileHeroImage || settings.heroImage || ''} alt="Portada" className="w-full h-auto block" />
          ) : (
            <div
              className="w-full h-28 flex items-center justify-center text-[10px]"
              style={{ backgroundColor: `${settings.primaryColor}22`, color: settings.textColor }}
            >
              Sin portada
            </div>
          )}

          {/* Sections */}
          <div className="p-3 space-y-3">
            {enabledSections.length === 0 && (
              <p className="text-[10px] text-center py-6" style={{ color: settings.textColor }}>
                Sin secciones configuradas
              </p>
            )}
            {enabledSections.map((section) => (
              <div key={section.id} className="rounded-lg overflow-hidden border border-black/5">
                {section.type === 'BANNER' && (
                  <div
                    className="h-16 flex items-center justify-center text-[10px] font-semibold"
                    style={{ backgroundColor: `${settings.promoColor}22`, color: settings.promoColor }}
                  >
                    {section.title || 'Banner'}
                  </div>
                )}
                {section.type === 'TEXT_BLOCK' && (
                  <div className="p-2.5">
                    {section.title && (
                      <p className="text-xs font-bold mb-1" style={{ color: settings.textColor }}>
                        {section.title}
                      </p>
                    )}
                    <p className="text-[10px]" style={{ color: settings.textColor }}>
                      {(section.config?.body as string) || section.subtitle || ''}
                    </p>
                  </div>
                )}
                {section.type === 'IMAGE_GALLERY' && (
                  <div className="grid grid-cols-3 gap-0.5 p-1">
                    {((section.config?.imageUrls as string[]) || ['', '', '']).slice(0, 3).map((url, i) => (
                      <div key={i} className="aspect-square bg-gray-100 rounded overflow-hidden">
                        {url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <button
              className="w-full py-2 rounded-lg text-[10px] font-semibold text-white"
              style={{ backgroundColor: settings.buttonColor }}
            >
              Ver catálogo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
