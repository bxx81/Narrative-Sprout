import { type ButtonHTMLAttributes } from "react";

interface SettingsSectionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  header?: string;
  ariaLabelledby: string;
  icon?: React.ReactNode;
}

export default function SettingsSection({
  header,
  ariaLabelledby,
  children,
  icon,
  ...props
}: SettingsSectionProps) {
  return header ? (
    <section aria-labelledby={ariaLabelledby} className="mb-10" {...props}>
      <h3 className="h2-style flex items-center gap-2">
        {icon}
        {header}
      </h3>
      {children}
    </section>
  ) : (
    <div className="mb-10">{children}</div>
  );
}
