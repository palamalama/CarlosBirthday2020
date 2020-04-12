import React from "react";
import * as d3 from "d3";

class MainCharacter extends React.Component{
	render(){
		return (
			<g ref={(group) => this.group = group}>
				<circle cx="50%" cy="50%" fill="red" stroke="crimson"/>
				<text x="50%" y="50%">
					{this.props.me.name}
				</text>	
			</g>
		);
	}
	componentDidUpdate(){
		let radius= Math.sqrt(this.props.me.size*3);
		let strokeWidth = Math.sqrt(this.props.me.size*2);
		let fontSize = Math.sqrt(this.props.me.size)+15;

		let transitionGroup = d3.select(this.group)
			.transition()
			.duration(100)
			
		transitionGroup.select("circle")
			.attr("r",radius)
			.attr("stroke-width",strokeWidth);
		transitionGroup.select("text")
			.attr("font-size",fontSize);
	}
}

export default MainCharacter;
