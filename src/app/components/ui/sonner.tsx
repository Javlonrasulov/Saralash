import { Toaster as Sonner } from 'sonner';
import { useTheme } from 'next-themes';

type ToasterProps = React.ComponentProps<typeof Sonner>;

export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme as ToasterProps['theme']}
      richColors
      position="top-center"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'bg-white border border-slate-200 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 rounded-xl shadow-lg',
          description: 'text-slate-500 dark:text-slate-400 text-xs',
        },
      }}
      {...props}
    />
  );
}
