export const MINT_PRICE = 0.00001;
export const OPEN_MULT = 69 / 31;
export const CASH_BUFFER_XCP = 2;
export const MAX_NAME_SLEEVE = 0.25;
export const THIN_POOL_XCP = 200;
export const MIN_DIP_POOL_XCP = 300;
export const POST_OPEN_BLOCKS = 72;
export const FRESH_GRAD_BLOCKS = 144;
export const LAST_LOTS_FILL = 0.8;
export const LAST_LOTS_BLOCKS = 200;
export const THIN_IMPACT = 0.08;
export const MAX_SETUPS = 5;

/** Raw Core integers for the XCP-69 mint template. */
export const XCP69 = {
  pool_quantity: 3100000000000000,
  soft_cap: 6900000000000000,
  hard_cap: 10000000000000000,
  quantity_by_price: 100000000000,
  price: 1000000,
  max_mint_per_address: 100000000000000,
  max_mint_per_tx: 100000000000000,
  premint_quantity: 0,
  minted_asset_commission_int: 0,
} as const;

export type Xcp69Fairminter = {
  asset: string;
  pool_quantity: number;
  soft_cap: number;
  hard_cap: number;
  quantity_by_price: number;
  price: number;
  max_mint_per_address: number;
  max_mint_per_tx: number;
  premint_quantity: number;
  minted_asset_commission_int?: number;
  lock_quantity: boolean;
  lock_description: boolean;
  divisible: boolean;
  burn_payment: boolean;
};

export function isXcp69(fairminter: Xcp69Fairminter): boolean {
  const commission = fairminter.minted_asset_commission_int ?? 0;
  return (
    fairminter.pool_quantity === XCP69.pool_quantity &&
    fairminter.soft_cap === XCP69.soft_cap &&
    fairminter.hard_cap === XCP69.hard_cap &&
    fairminter.quantity_by_price === XCP69.quantity_by_price &&
    fairminter.price === XCP69.price &&
    fairminter.max_mint_per_address === XCP69.max_mint_per_address &&
    fairminter.max_mint_per_tx === XCP69.max_mint_per_tx &&
    fairminter.premint_quantity === XCP69.premint_quantity &&
    commission === XCP69.minted_asset_commission_int &&
    fairminter.lock_quantity === true &&
    fairminter.lock_description === true &&
    fairminter.divisible === true &&
    fairminter.burn_payment === false &&
    typeof fairminter.asset === "string" &&
    fairminter.asset.length > 0 &&
    !fairminter.asset.startsWith("A")
  );
}
