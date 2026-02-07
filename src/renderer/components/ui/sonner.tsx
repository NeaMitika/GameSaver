import { Toaster as Sonner, toast } from 'sonner';
import type { ComponentProps } from 'react';

type ToasterProps = ComponentProps<typeof Sonner>;

function Toaster(props: ToasterProps) {
	return (
		<Sonner
			theme='dark'
			position='bottom-right'
			closeButton
			richColors
			className='toaster group'
			toastOptions={{
				classNames: {
					toast:
						'group toast group-[.toaster]:border-border group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:shadow-lg',
					description: 'group-[.toast]:text-muted-foreground',
					actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
					cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
				},
			}}
			{...props}
		/>
	);
}

export { Toaster, toast };
