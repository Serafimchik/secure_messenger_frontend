function WelcomeScreen({ onNavigate }) {
    return (
      <div className="card">
        <h1>Добро пожаловать в Secure Messenger</h1>
        <div className="button-group">
          <button onClick={() => onNavigate('login')} className="btn blue">Войти</button>
          <button onClick={() => onNavigate('register')} className="btn green">Создать аккаунт</button>
        </div>
      </div>
    );
  }
  
  export default WelcomeScreen;
  