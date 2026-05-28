import { Text, View } from 'react-native';

import { cn } from '@/lib/cn';

export type PickSummaryMetricTone = 'muted' | 'green' | 'red' | 'gold';

export type PickSummaryMetric = {
  label: string;
  tone?: PickSummaryMetricTone;
  value: string;
};

function PickSummaryMetricTile({
  label,
  tone = 'muted',
  value,
}: PickSummaryMetric) {
  const valueClass =
    tone === 'green'
      ? 'text-electric-green'
      : tone === 'red'
        ? 'text-coral-red'
        : tone === 'gold'
          ? 'text-gold'
          : 'text-white/75';

  return (
    <View
      className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2"
      style={{ flexBasis: '47%', flexGrow: 1, flexShrink: 1, minWidth: 116 }}>
      <Text className="text-[9px] font-black uppercase text-white/40" numberOfLines={1}>
        {label}
      </Text>
      <Text
        adjustsFontSizeToFit
        className={cn('mt-0.5 text-sm font-black', valueClass)}
        minimumFontScale={0.82}
        numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export function PickSummaryMetricGrid({
  metrics,
  showTopBorder = true,
}: {
  metrics: PickSummaryMetric[];
  showTopBorder?: boolean;
}) {
  return (
    <View
      className={cn(
        'flex-row flex-wrap gap-2',
        showTopBorder ? 'border-t border-white/[0.08] pt-3' : '',
      )}>
      {metrics.map((metric) => (
        <PickSummaryMetricTile
          key={metric.label}
          label={metric.label}
          tone={metric.tone}
          value={metric.value}
        />
      ))}
    </View>
  );
}
