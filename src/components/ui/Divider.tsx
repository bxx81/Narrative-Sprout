import styles from "./Divider.module.css";

interface DividerProps {
  className?: string;
  color?: string;
}

export const Divider: React.FC<DividerProps> = ({ className, color }) => {
  return (
    <hr className={[color ?? "text-divider", className, styles["dividers-marker"]].join(" ")} />
  );
};
