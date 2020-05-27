import React from "react";
import * as d3 from "d3";

class Person extends React.Component {
	render(){
		if(!this.props.person ||!this.props.centerCoordinates|| !this.props.mainCharacter){
			return (
				<text x="10px" y="10px">
					Something went wrong
				</text>
			);
		}
		else if(this.props.person.state == "deleted" || this.props.person.state == "eaten"){
			return (null);
		}
		return (
			<g ref={(person) => this.person = person} className="people">
				<circle fill="red" stroke="crimson"/>
				<text>
					{this.props.person.name}
				</text>
			</g>
		);
	}	
	componentDidUpdate(){
		let x = this.props.person.x - this.props.mainCharacter.x+this.props.centerCoordinates.x;
		let y = this.props.person.y - this.props.mainCharacter.y+this.props.centerCoordinates.y;
		let radius= Math.sqrt(this.props.person.size*3);
		let strokeWidth = Math.sqrt(this.props.person.size*2);
		let fontSize = Math.sqrt(this.props.person.size)+15;

		let transitionGroup = d3.select(this.person)
			.transition()
			.duration(100)
			
		transitionGroup.select("circle")
			.attr("cx",x)
			.attr("cy",y)
			.attr("r",radius)
			.attr("stroke-width",strokeWidth);
		transitionGroup.select("text")
			.attr("x",x)
			.attr("y",y)
			.attr("font-size",fontSize);
	}
}

export default Person;
