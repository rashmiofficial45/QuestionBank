import type { Content } from "@/lib/content";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export function RankedFields({ options, prompts, selected = [] }: {
  options: Content["options"]; prompts?: string[]; selected?: string[];
}) {
  const labels = prompts ?? options.map((_, index) => `Position ${index + 1}`);
  return <div className="grid gap-3">
    {labels.map((label, index) => <label className="field" key={index}>
      {label}
      <NativeSelect name="option" aria-label={label} defaultValue={selected[index] ?? ""} required>
        <NativeSelectOption value="">Choose an item</NativeSelectOption>
        {options.map((option) => <NativeSelectOption key={option.id} value={option.id}>{option.text}</NativeSelectOption>)}
      </NativeSelect>
    </label>)}
  </div>;
}

export function rankedLabels(options: Content["options"], ids: string[], prompts?: string[]) {
  return ids.map((id, index) => {
    const text = options.find((option) => option.id === id)?.text ?? "";
    return prompts ? `${prompts[index]} → ${text}` : `${index + 1}. ${text}`;
  }).join("\n");
}
