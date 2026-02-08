type GameExeIconProps = {
  icon: string | null;
  name: string;
};

export default function GameExeIcon({ icon, name }: GameExeIconProps) {
  const fallback = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/60 text-[10px] font-semibold text-muted-foreground">
      {icon ? <img src={icon} alt="" className="size-full object-cover" /> : fallback}
    </div>
  );
}
