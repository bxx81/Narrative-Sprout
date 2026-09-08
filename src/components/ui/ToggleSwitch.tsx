import React, { type FC, type InputHTMLAttributes } from "react";

interface BaseProps extends InputHTMLAttributes<HTMLInputElement> {
  children?: React.ReactNode;
  disabled?: boolean;
}

interface ControlledProps extends BaseProps {
  checked?: boolean;
  defaultChecked?: never;
}

interface UncontrolledProps extends BaseProps {
  checked?: never;
  defaultChecked?: boolean;
}

type Props = ControlledProps | UncontrolledProps;

const ToggleSwitch: FC<Props> = ({
  checked,
  defaultChecked,
  onChange = () => {
    // nothing
  },
  children,
  disabled = false,
}) => (
  <div className="relative flex flex-wrap items-center">
    <input
      /* eslint-disable better-tailwindcss/no-conflicting-classes -- hover 時と focus 時の checked:after 背景色は意図的な使い分け。両者が出す content 宣言は同値であり無害。 */
      className="peer relative h-6 w-12 cursor-pointer appearance-none rounded-xl bg-slate-300 transition-colors after:absolute after:top-0 after:left-0 after:size-6 after:rounded-full after:bg-slate-500 after:transition-all checked:bg-lime-200 checked:after:left-6 checked:after:bg-lime-500 hover:bg-slate-400 after:hover:bg-slate-600 checked:hover:bg-lime-300 checked:after:hover:bg-lime-600 focus:outline-none checked:focus:bg-lime-400 checked:after:focus:bg-lime-700 focus-visible:outline-none disabled:cursor-default disabled:bg-slate-200 disabled:after:bg-slate-300"
      type="checkbox"
      checked={checked}
      defaultChecked={defaultChecked}
      onChange={(event) => onChange(event)}
      disabled={disabled}
    />
    {/* eslint-enable better-tailwindcss/no-conflicting-classes */}
    <span>{children}</span>
  </div>
);

export default ToggleSwitch;
