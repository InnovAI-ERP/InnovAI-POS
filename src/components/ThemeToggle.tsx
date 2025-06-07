import React from 'react';
import { Sun, Moon } from 'lucide-react';

interface TooltipProps {
  children: React.ReactNode;
}

interface TooltipTriggerProps {
  asChild: boolean;
  children: React.ReactNode;
}

interface TooltipContentProps {
  children: React.ReactNode;
}

// Componentes simples para el tooltip
const Tooltip: React.FC<TooltipProps> = ({ children }) => {
  return <div className="relative inline-block">{children}</div>;
};

const TooltipTrigger: React.FC<TooltipTriggerProps> = ({ asChild, children }) => {
  return <>{children}</>;
};

const TooltipContent: React.FC<TooltipContentProps> = ({ children }) => {
  return (
    <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-dark-400/80 dark:bg-dark-300/80 text-black dark:text-white text-xs rounded whitespace-nowrap">
      {children}
    </div>
  );
};

const ThemeToggle: React.FC = () => {
  const [theme, setThemeState] = React.useState<"light" | "dark">("light");

  React.useEffect(() => {
    const storedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    
    // Si hay un tema guardado, usarlo; de lo contrario, usar light como predeterminado
    if (storedTheme) {
      setThemeState(storedTheme);
    } else {
      // Establecer tema claro como predeterminado siempre
      setThemeState("light");
      localStorage.setItem("theme", "light");
    }
  }, []);

  React.useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prevTheme) => (prevTheme === "dark" ? "light" : "dark"));
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button 
          className="p-1 bg-transparent hover:bg-transparent transition-colors relative flex items-center justify-center" 
          onClick={toggleTheme} 
          aria-label="Toggle theme"
        >
          <Sun className="h-[1.4rem] w-[1.4rem] transition-all duration-300 transform translate-x-0 scale-100 dark:scale-0 text-gold-500" />
          <Moon className="h-[1.4rem] w-[1.4rem] transition-all duration-300 absolute transform scale-0 dark:scale-100 text-white" />
          <span className="sr-only">Cambiar tema</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default ThemeToggle;