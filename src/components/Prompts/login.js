import React from "react";

class LoginPrompt extends React.Component {
	constructor(props){
		super(props);
		this.loginButtonClicked = this.loginButtonClicked.bind(this);
		this.updateInputValue = this.updateInputValue.bind(this);
		this.state = {
			inputValue:  ""
		};
	}
	render(){
		return (
			<foreignObject x="0" y="0" width="100%" height="100%">
				<div className="login" style={{"height":"40%","minHeight":"400px","width":"40%","minWidth":"600px",
					"margin":"auto","border": "1px solid black"}}
				>
					<div className="loginTitle" style={{"fontSize": "50px","margin":"auto","fontFamily":'"Arial Black", Gadget, sans-serif',"textAlign":"center"}}>
						Welcome To Carlos.io!
					</div>
					<div className="textInput" style={{"width":"80%","margin":"auto","height":"200px"}}>
						<div className="loginTitle" style={{"fontSize": "30px","fontFamily":'"Arial Black", Gadget, sans-serif'}}>
							Pick a name
						</div>
						<input className="loginInput" style={{"width":"100%","height":"40px"}} value={this.state.inputValue} onChange={this.updateInputValue}/>
						<button className="loginButton" style={{"width":"40%","margin":"auto"}} onClick={this.loginButtonClicked}>
							Join Room!
						</button> 
					</div>
				</div>
			</foreignObject>
		);
	}
	updateInputValue(evt){
		this.setState({
			inputValue:evt.target.value
		});
	}
	loginButtonClicked(){
		this.props.login(this.state.inputValue);
	}
}
export default LoginPrompt;
