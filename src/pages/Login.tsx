import React, { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";

/**
 * Componente de Login
 * Permite a los usuarios iniciar sesión en la aplicación
 * El sistema identifica automáticamente la empresa basado en las credenciales
 */
const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, loading } = useAuth();

  // Función para manejar el envío del formulario de inicio de sesión
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    try {
      console.log(`Iniciando sesión con usuario: ${username}`);
      
      // Iniciar sesión - ahora el hook useAuth se encargará de identificar la empresa
      const { success, error: loginError } = await login(username, password);
      
      if (!success) {
        console.error('Error de login:', loginError);
        setError(loginError || "Credenciales incorrectas. Por favor, inténtalo de nuevo.");
      }
      // La redirección se maneja automáticamente en el hook useAuth
    } catch (err) {
      console.error('Error inesperado:', err);
      setError("Ocurrió un error al iniciar sesión. Por favor, intenta nuevamente.");
    }
  };

  // Función para manejar el olvido de contraseña
  const handleForgotPassword = () => {
    window.open("https://wa.me/+50688821455?text=Necesito%20recuperar%20mi%20contrase%u00f1a", "_blank");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
    >
      <div className="glass-card p-8 rounded-2xl w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-gradient text-center">Iniciar Sesión</h2>
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-100 px-4 py-2 rounded-lg mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Campos de usuario y contraseña */}
          <div>
            <label className="block text-sm font-medium mb-2">Usuario</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-blue-400 focus:outline-none"
              placeholder="Introduzca su ID de usuario"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-blue-400 focus:outline-none"
              placeholder="Contraseña"
              required
            />
          </div>
          <div className="text-right">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mt-6"
            type="submit"
            disabled={loading}
          >
            {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
          </motion.button>
        </form>
      </div>
    </motion.div>
  );
};

export default Login;