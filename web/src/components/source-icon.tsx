import { FileIcon, GithubIcon, PencilIcon } from "@/components/icons";

type SourceIconProps = {
  sourceName?: string;
  documentType?: string;
  className?: string;
};

export function SourceIcon({ sourceName = "", documentType = "", className }: SourceIconProps) {
  const label = `${sourceName} ${documentType}`.toLowerCase();
  const iconClass = className ?? "h-5 w-5";

  if (label.includes("github") || label.includes("codebase")) {
    return <GithubIcon className={iconClass} />;
  }

  if (label.includes("text input") || label.includes("note")) {
    return <PencilIcon className={iconClass} />;
  }

  return <FileIcon className={iconClass} />;
}
