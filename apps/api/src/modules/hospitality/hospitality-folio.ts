import { Prisma } from '@prisma/client';
export type MoneyInput=string|number;
export function money(value:MoneyInput):Prisma.Decimal{const d=new Prisma.Decimal(value);if(!d.isFinite()||d.decimalPlaces()>2)throw new Error('Nilai uang harus finite dengan maksimal 2 desimal.');return d;}
export function signedAmount(kind:string,amount:MoneyInput):string{const d=money(amount).abs();return(['PAYMENT','DEPOSIT','ALLOWANCE'].includes(kind)?d.neg():d).toFixed(2);}
export function creditAvailable(limit:MoneyInput,balance:MoneyInput,pending:MoneyInput='0'){return money(limit).sub(money(balance)).sub(money(pending));}

