/**
 * SegmentedControl — 通用 segmented 三态控件(v1.3 新增)
 *
 * 用于薪资模式切换(按月结 / 按时结 / 按日结)等场景。
 */
import styles from './SegmentedControl.module.css';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}

export function SegmentedControl<T extends string>({ options, value, onChange, disabled }: Props<T>) {
  return (
    <div className={`${styles.group} ${disabled ? styles.disabled : ''}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`${styles.item} ${value === opt.value ? styles.active : ''}`}
          onClick={() => !disabled && onChange(opt.value)}
          disabled={disabled}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}