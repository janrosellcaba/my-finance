"use client";

import { useMemo } from "react";
import {
    Bar,
    CartesianGrid,
    ComposedChart,
    Line,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { formatDate } from "../../shared";
import { useT } from "@/i18n/I18nProvider";
import { DOWN_COLOR, UP_COLOR, formatAxisDate, formatAxisValue, formatMoney, formatRate, type AppLanguage } from "./format";
import type { MarketPeriod, PeriodView } from "./marketsMath";

export type ChartMode = "line" | "candles";

type Row = {
    date: string;
    value: number;
    o?: number;
    h?: number;
    l?: number;
    c?: number;
    range?: [number, number];
};

type CandleShapeProps = { x: number; y: number; width: number; height: number; payload: Row };

function Candle({ x, y, width, height, payload }: CandleShapeProps) {
    const { o, h, l, c } = payload;
    if (o === undefined || h === undefined || l === undefined || c === undefined) return null;

    const top = Math.min(y, y + height);
    const span = Math.abs(height);
    const range = h - l;
    const toY = (v: number) => (range === 0 ? top : top + ((h - v) / range) * span);

    const color = c >= o ? UP_COLOR : DOWN_COLOR;
    const bodyTop = Math.min(toY(o), toY(c));
    const bodyHeight = Math.max(1, Math.abs(toY(o) - toY(c)));
    const bodyWidth = Math.max(1, width * 0.72);
    const center = x + width / 2;

    return (
        <g>
            <line x1={center} x2={center} y1={toY(h)} y2={toY(l)} stroke={color} strokeWidth={1} />
            <rect x={center - bodyWidth / 2} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={color} />
        </g>
    );
}

export function MarketChart({
    view,
    mode,
    lastPrice,
    currency,
    isRate,
    language,
    period,
}: {
    view: PeriodView;
    mode: ChartMode;
    lastPrice: number | null;
    currency: string;
    isRate: boolean;
    language: AppLanguage;
    period: MarketPeriod;
}) {
    const t = useT();
    // Funds publish a single price per day: a candle would be a flat tick, so draw a line instead.
    const candlesUnavailable = mode === "candles" && !view.hasRange;
    const effective: ChartMode = candlesUnavailable ? "line" : mode;
    const up = (view.changePct ?? 0) >= 0;
    const color = up ? UP_COLOR : DOWN_COLOR;

    const data = useMemo<Row[]>(() => {
        if (effective === "candles") {
            return view.candles.map(([date, o, h, l, c]) => ({ date, value: c, o, h, l, c, range: [l, h] }));
        }
        return view.series.map(([date, value]) => ({ date, value }));
    }, [effective, view]);

    const fmt = (v: number) => (isRate ? formatRate(v, language) : formatMoney(v, currency, language));
    const axisTick = { fontSize: 10, fill: "var(--color-muted)" };

    return (
        <div>
            <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="var(--color-line)" strokeDasharray="2 4" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={(v: string) => formatAxisDate(v, period, language)}
                            tick={axisTick}
                            tickLine={false}
                            axisLine={{ stroke: "var(--color-line)" }}
                            interval="preserveStartEnd"
                            minTickGap={44}
                            tickMargin={6}
                        />
                        <YAxis
                            orientation="right"
                            domain={["auto", "auto"]}
                            tickCount={6}
                            width={58}
                            tickFormatter={(v: number) => formatAxisValue(v, language, isRate)}
                            tick={axisTick}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip
                            isAnimationActive={false}
                            cursor={
                                effective === "candles"
                                    ? { fill: "var(--color-muted)", fillOpacity: 0.1 }
                                    : { stroke: "var(--color-muted)", strokeDasharray: "3 3" }
                            }
                            content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0].payload as Row;
                                return (
                                    <div className="rounded-xl border border-line bg-paper px-3 py-2 text-xs shadow-sm">
                                        <p className="text-muted">{formatDate(d.date)}</p>
                                        {d.o !== undefined && d.h !== undefined && d.l !== undefined && d.c !== undefined ? (
                                            <dl className="mt-1 grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 tabular-nums">
                                                <dt className="text-muted">{t("markets.open")}</dt>
                                                <dd className="text-right font-semibold text-ink">{fmt(d.o)}</dd>
                                                <dt className="text-muted">{t("markets.high")}</dt>
                                                <dd className="text-right font-semibold text-ink">{fmt(d.h)}</dd>
                                                <dt className="text-muted">{t("markets.low")}</dt>
                                                <dd className="text-right font-semibold text-ink">{fmt(d.l)}</dd>
                                                <dt className="text-muted">{t("markets.closeShort")}</dt>
                                                <dd className="text-right font-semibold text-ink">{fmt(d.c)}</dd>
                                            </dl>
                                        ) : (
                                            <p className="mt-0.5 font-semibold tabular-nums text-ink">
                                                {fmt(d.value)}
                                            </p>
                                        )}
                                    </div>
                                );
                            }}
                        />
                        {lastPrice !== null && (
                            <ReferenceLine
                                y={lastPrice}
                                stroke={color}
                                strokeDasharray="4 3"
                                strokeOpacity={0.75}
                                ifOverflow="extendDomain"
                                label={{
                                    value: formatAxisValue(lastPrice, language, isRate),
                                    position: "insideTopRight",
                                    fill: color,
                                    fontSize: 10,
                                    fontWeight: 700,
                                }}
                            />
                        )}
                        {effective === "line" && (
                            <Line
                                type="linear"
                                dataKey="value"
                                stroke={color}
                                strokeWidth={1.5}
                                dot={false}
                                activeDot={{ r: 3.5, strokeWidth: 0, fill: color }}
                                isAnimationActive={false}
                            />
                        )}
                        {effective === "candles" && (
                            <Bar
                                dataKey="range"
                                maxBarSize={14}
                                isAnimationActive={false}
                                shape={(props: unknown) => <Candle {...(props as CandleShapeProps)} />}
                            />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
            {candlesUnavailable && <p className="mt-1 text-[11px] text-muted">{t("markets.noCandles")}</p>}
        </div>
    );
}
