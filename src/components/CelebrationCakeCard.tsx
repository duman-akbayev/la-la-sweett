// =============================================================================
// La La Sweett — Celebration Cake Card
// Renders a single custom cake. Cakes with multiple sizes show a clear price
// table (Classic / Berry per size); flat-priced cakes show a single price.
// =============================================================================

import Image from "next/image";
import { ProductSpecs } from "@/components/ProductSpecs";
import { BERRY_OPTION_LABEL, type CelebrationCake } from "@/data/cakes";

export interface CelebrationCakeCardProps {
  cake: CelebrationCake;
}

const usd = (amount: number) => `$${amount}`;

function SizePriceTable({ cake }: { cake: CelebrationCake }) {
  if (!cake.sizes) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-input border border-brand-rose/[0.08]">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-brand-blush/40 text-caption uppercase tracking-wide text-brand-taupe">
            <th scope="col" className="px-3 py-2 font-semibold">
              Size
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              Classic
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              {BERRY_OPTION_LABEL}
            </th>
          </tr>
        </thead>
        <tbody>
          {cake.sizes.map((option) => (
            <tr
              key={option.size}
              className="border-t border-brand-rose/[0.06] text-body-sm"
            >
              <th scope="row" className="px-3 py-2 font-medium text-brand-brown">
                {option.size}{" "}
                <span className="font-normal text-brand-taupe">
                  ({option.serves})
                </span>
              </th>
              <td className="px-3 py-2 text-right font-semibold text-brand-brown">
                {usd(option.classic)}
              </td>
              <td className="px-3 py-2 text-right font-semibold text-brand-primary">
                {option.berry != null ? usd(option.berry) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CelebrationCakeCard({ cake }: CelebrationCakeCardProps) {
  return (
    <article className="product-card group flex flex-col">
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={cake.image}
          alt={cake.imageAlt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
          loading="lazy"
        />
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-display text-heading-3 text-brand-brown">
            {cake.name}
          </h3>
          {cake.flatPrice && (
            <div className="shrink-0 text-right">
              <span className="block text-lg font-semibold text-brand-primary">
                {usd(cake.flatPrice.price)}
              </span>
              <span className="block text-xs text-brand-taupe">
                {cake.flatPrice.weight}
              </span>
            </div>
          )}
        </div>

        <p className="mt-3 text-body-sm leading-relaxed text-brand-taupe">
          {cake.description}
        </p>

        <SizePriceTable cake={cake} />

        <div className="mt-auto">
          <ProductSpecs
            storage={cake.storage}
            shelfLife={cake.shelfLife}
            allergens={cake.allergens}
          />
        </div>
      </div>
    </article>
  );
}
