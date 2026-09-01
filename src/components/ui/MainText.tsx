import { Divider } from "./Divider";
import styles from "./MainText.module.css";

interface MainTextProps {
  text: string;
  className?: string;
}

const MainText = ({ text, className }: MainTextProps) => {
  if (!text) return null;

  const lines = text.split("\n");

  return (
    <div className={styles["main-text"]}>
      {lines.map((line, lineIndex) => {
        if (/^---+\s*$|^\*\*\*+\s*$/.test(line.trim())) {
          return <Divider key={lineIndex} />;
        }

        const startsWithBracket = /^[「『（(〔［[｛{〈《]/.test(line.trimStart());

        const pClassName = [className, startsWithBracket ? styles["bracket-start"] : ""]
          .filter(Boolean)
          .join(" ");

        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
          <p key={lineIndex} className={pClassName}>
            {parts.map((part, index) => {
              if (part.startsWith("**") && part.endsWith("**")) {
                const content = part.slice(2, -2);
                return (
                  <strong key={index} className="font-bold">
                    {content}
                  </strong>
                );
              }
              return part;
            })}
          </p>
        );
      })}
    </div>
  );
};

export default MainText;
