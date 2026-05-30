import React, { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";

class ErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = { error: null };
	}

	static getDerivedStateFromError(error) {
		return { error };
	}

	componentDidCatch(error, info) {
		// eslint-disable-next-line no-console
		console.error('ErrorBoundary caught', error, info);
	}

	render() {
		if (this.state.error) {
			return (
				React.createElement('div', { style: { padding: 20 } },
					React.createElement('h2', null, 'Erreur d\'hydratation'),
					React.createElement('p', null, String(this.state.error)),
					React.createElement('button', { onClick: () => window.location.reload() }, 'Recharger')
				)
			);
		}

		return this.props.children;
	}
}

startTransition(() => {
		try {
		const rootEl = document.getElementById("root");
		if (!rootEl) throw new Error("Root element #root introuvable");
		hydrateRoot(rootEl, (
			<StrictMode>
				<ErrorBoundary>
					{(() => {
						try {
							const router = getRouter();
							return React.createElement(RouterProvider as any, { router }, null);
						} catch (err) {
							console.error('LocalStartClient failed to get router:', err);
							return null;
						}
					})()}
				</ErrorBoundary>
			</StrictMode>
		));
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error('Hydratation client échouée:', err);
		throw err;
	}
});

// Use official StartClient from @tanstack/react-start-client
