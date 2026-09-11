import { en } from "./en";

type DeepStringify<T> = {
    [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>;
};

export type Messages = DeepStringify<typeof en>;
