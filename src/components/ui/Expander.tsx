import React, { useState } from "react";

interface ExpanderProps {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
  id: string;
  ariacontrols: string;
  labelText: string;
  icon?: React.ReactNode;
}

const Expander: React.FC<ExpanderProps> = ({
  children,
  className = "",
  as: Component = "div",
  id,
  ariacontrols,
  labelText,
  icon,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const handleClick = () => {
    setIsOpen(!isOpen);
  };
  return (
    <Component id={id} className="block" aria-expanded={isOpen} aria-controls={ariacontrols}>
      <div className="w-full">
        <div
          role="button"
          tabIndex={0}
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              handleClick();
            }
          }}
          className="h2-style flex justify-between"
        >
          <h3 className={`flex items-center gap-2 ${className}`}>
            {icon}
            <p className={className}>{labelText}</p>
          </h3>
          <svg
            className={`text-text-support size-5 self-center transition-transform duration-300 ${isOpen ? "rotate-180 transform" : ""}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <div
          id={ariacontrols}
          className={`grid min-h-0 transition-all duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        >
          <div className="space-y-5 overflow-hidden p-1">{children}</div>
        </div>
      </div>
    </Component>
  );
};

export default Expander;
