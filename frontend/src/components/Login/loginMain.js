import React from "react";

class Login extends React.Component {
	constructor(props){
		super(props);
	}
	render(){
		return (
			<div className="login" style={{"height":"40%","minHeight":"400px","width":"40%","minWidth":"600px",
				"margin":"auto","border": "1px solid black"}}
			>
				<div className="loginTitle" style={{"fontSize": "50px","margin":"auto","fontFamily":'"Arial Black", Gadget, sans-serif',"textAlign":"center"}}>
					Welcome To Carlos.io!
				</div>
			</div>
		);
	}
}
export default Login;
