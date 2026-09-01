export type IconName =
  | "account_circle"
  | "api"
  | "arrow_left_alt"
  | "attach_file_add"
  | "autoplay"
  | "autorenew"
  | "autostop"
  | "check"
  | "close"
  | "close_small"
  | "cloud_download"
  | "cloud_upload"
  | "database"
  | "delete"
  | "delete_forever"
  | "display_settings"
  | "edit"
  | "fullscreen"
  | "fullscreen_exit"
  | "gamepad"
  | "home"
  | "import_contacts"
  | "key"
  | "keyboard_arrow_left"
  | "keyboard_arrow_right"
  | "language"
  | "last_page"
  | "login"
  | "logout"
  | "more_horiz"
  | "psychiatry"
  | "question_mark"
  | "redo"
  | "send"
  | "service_toolbox"
  | "settings"
  | "stop_circle"
  | "text_snippet"
  | "translate"
  | "tune"
  | "upload"
  | "warning"
  | "auto_awesome_mosaic"
  | "unfold_less"
  | "unfold_more"
  | "downloading"
  | "summarize";

interface IconProps {
  className?: string;
  iconName: IconName;
}

export const Icon = ({ className, iconName }: IconProps) => {
  return <span className={`material-symbols-rounded ${className}`}>{iconName}</span>;
};
