"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, type ComponentProps, type ReactNode } from "react";

type Props = Omit<ComponentProps<typeof Link>, "onClick"> & {
  children: ReactNode;
};

export function TransitionLink({ href, children, prefetch, ...props }: Props) {
  const router = useRouter();

  const navigate = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      const url = typeof href === "string" ? href : href.pathname ?? "/";
      if (document.startViewTransition) {
        document.startViewTransition(() => {
          router.push(url);
        });
      } else {
        router.push(url);
      }
    },
    [href, router]
  );

  return (
    <Link href={href} prefetch={prefetch} onClick={navigate} {...props}>
      {children}
    </Link>
  );
}
