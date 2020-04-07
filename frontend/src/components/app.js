import React from "react";
import Login from "./Login/loginMain";
import Game from "./Game/gameMain";

class App extends React.Component {

	constructor(props){
		super(props);
		this.login = this.login.bind(this);
		this.state = {
		};
	}

	render() {
		if(this.state.name != undefined){
			return (
				<div className="app" style={{"width":"100%","height":"100%"}}>
					<Game name={this.state.name} />
				</div>
			);
		}
		else{
			return (
				<div className="app" style={{"width":"100%","height":"100%"}}>
					<Login login={this.login}/>
				</div>
			);
		}
	}
	login(name){
		console.log("You just Logged In!",name);
		this.setState({
			name:name||"Anonymous Alpaca"
		});	
	}
}

export default App;
